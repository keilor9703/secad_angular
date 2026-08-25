import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../auth/auth.service';

export interface DtoCrearVideoSesionRequest {
  pedidoId: string;
  numeroTelefono: string;
}

export interface DtoCrearVideoSesionResult {
  success: boolean;
  message: string;
  sesionId: string;
  sessionToken: string;
  fechaExpira: string;
  smsEnviado: boolean;
}

export type EstadoLlamada = 'inactiva' | 'esperando' | 'conectando' | 'conectada' | 'finalizada' | 'error';

export interface ChatMensaje {
  texto: string;
  propio: boolean;
  hora: string;
}

/**
 * Lado despachador de la videollamada WebRTC punto-a-punto con el ciudadano.
 * Se conecta al mismo VideoSignalingHub que la página pública del ciudadano
 * (ver video-ciudadano.ts), pero autenticado con el JWT normal de SECAD.
 *
 * Maneja un solo RTCPeerConnection a la vez — cada caso solo tiene un
 * despachador y un ciudadano en la sesión (sin SFU, ver decisión de diseño).
 */
@Injectable({ providedIn: 'root' })
export class VideoLlamadaService {

  private readonly base = `${environment.apiBaseUrl}/VideoLlamada`;
  private readonly hubUrl = `${environment.apiBaseUrl}/hubs/video`;

  private hub: signalR.HubConnection | null = null;
  private pc: RTCPeerConnection | null = null;
  private sesionId = '';

  // Micrófono propio del despachador (se captura al crear la oferta) y canal
  // de datos P2P para chat de texto — ver decisiones en crearOferta().
  private micStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;

  private readonly estadoSubject = new BehaviorSubject<EstadoLlamada>('inactiva');
  readonly estado$: Observable<EstadoLlamada> = this.estadoSubject.asObservable();

  private readonly remoteStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  readonly remoteStream$: Observable<MediaStream | null> = this.remoteStreamSubject.asObservable();

  private readonly errorSubject = new BehaviorSubject<string>('');
  readonly error$: Observable<string> = this.errorSubject.asObservable();

  private readonly microfonoActivoSubject = new BehaviorSubject<boolean>(true);
  readonly microfonoActivo$: Observable<boolean> = this.microfonoActivoSubject.asObservable();

  private readonly chatDisponibleSubject = new BehaviorSubject<boolean>(false);
  readonly chatDisponible$: Observable<boolean> = this.chatDisponibleSubject.asObservable();

  private readonly chatMensajesSubject = new BehaviorSubject<ChatMensaje[]>([]);
  readonly chatMensajes$: Observable<ChatMensaje[]> = this.chatMensajesSubject.asObservable();

  /**
   * Servidores ICE — STUN público de Google siempre incluido; el TURN propio
   * (coturn) se agrega solo si viene configurado en environment.ts. Sin TURN,
   * muchas redes celulares con NAT simétrico de operador no logran completar
   * el flujo real de medios aunque el ICE parezca "conectado".
   */
  private construirIceServers(): RTCIceServer[] {
    const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    const turnUrls = (environment as Partial<{ turnUrls: string[] }>).turnUrls;
    const turnUsername = (environment as Partial<{ turnUsername: string }>).turnUsername;
    const turnCredential = (environment as Partial<{ turnCredential: string }>).turnCredential;
    if (turnUrls?.length) {
      servers.push({ urls: turnUrls, username: turnUsername, credential: turnCredential });
    }
    return servers;
  }

  constructor(private http: HttpClient, private authService: AuthService) {}

  crearSesion(pedidoId: string, numeroTelefono: string): Promise<DtoCrearVideoSesionResult> {
    return firstValueFrom(
      this.http.post<DtoCrearVideoSesionResult>(this.base, { pedidoId, numeroTelefono })
    );
  }

  /** Inicia la conexión de señalización y espera a que el ciudadano se conecte. */
  async iniciar(sesionId: string): Promise<void> {
    this.sesionId = sesionId;
    this.estadoSubject.next('esperando');
    this.errorSubject.next('');

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl, { accessTokenFactory: () => this.authService.getToken() ?? '' })
      .withAutomaticReconnect()
      .build();

    this.hub.on('error', (msg: string) => {
      this.errorSubject.next(msg);
      this.estadoSubject.next('error');
    });

    this.hub.on('ciudadano-conectado', () => {
      this.estadoSubject.next('conectando');
      this.crearOferta();
    });

    this.hub.on('answer', async (sdp: string) => {
      if (!this.pc) return;
      await this.pc.setRemoteDescription({ type: 'answer', sdp });
    });

    this.hub.on('ice-candidate', async (candidateJson: string) => {
      if (!this.pc) return;
      try { await this.pc.addIceCandidate(JSON.parse(candidateJson)); } catch { /* candidato tardío, ignorar */ }
    });

    this.hub.on('sesion-finalizada', () => this.finalizarLocal());

    await this.hub.start();
    await this.hub.invoke('JoinAsDespachador', sesionId);

    this.prepararPeerConnection();
  }

  private prepararPeerConnection(): void {
    this.pc = new RTCPeerConnection({ iceServers: this.construirIceServers() });

    this.pc.ontrack = (ev) => {
      this.remoteStreamSubject.next(ev.streams[0] ?? null);
      this.estadoSubject.next('conectada');
    };

    this.pc.onicecandidate = (ev) => {
      if (ev.candidate && this.hub) {
        this.hub.invoke('SendIceCandidate', this.sesionId, JSON.stringify(ev.candidate));
      }
    };
  }

  private async crearOferta(): Promise<void> {
    if (!this.pc || !this.hub) return;
    // Solo recibe video (el despachador no envía su propia cámara) — el video
    // es unidireccional ciudadano → despachador, ver decisión de diseño.
    // El audio sí es bidireccional: el despachador necesita poder hablarle
    // al ciudadano, así que captura su propio micrófono y lo conecta al
    // sender de este transceiver (antes solo se declaraba sendrecv sin
    // adjuntar ningún track real, por lo que el CAD nunca podía hablar).
    this.pc.addTransceiver('video', { direction: 'recvonly' });
    const audioTransceiver = this.pc.addTransceiver('audio', { direction: 'sendrecv' });

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await audioTransceiver.sender.replaceTrack(this.micStream.getAudioTracks()[0]);
      this.microfonoActivoSubject.next(true);
    } catch (err) {
      // El despachador sigue pudiendo ver/oír al ciudadano aunque no
      // conceda su propio micrófono — solo no podrá hablar por audio (le
      // queda el chat de texto).
      // eslint-disable-next-line no-console
      console.error('[video-llamada] no se pudo capturar el micrófono del despachador:', err);
    }

    // Chat de texto P2P — el despachador (offerer) crea el canal de datos;
    // el ciudadano lo recibe vía pc.ondatachannel. Permite comunicarse aunque
    // el despachador silencie su micrófono (p. ej. si el ciudadano no puede
    // recibir sonido sin delatarse ante un agresor).
    this.configurarDataChannel(this.pc.createDataChannel('chat'));

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.hub.invoke('SendOffer', this.sesionId, offer.sdp);
  }

  private configurarDataChannel(dc: RTCDataChannel): void {
    this.dataChannel = dc;
    dc.onopen = () => this.chatDisponibleSubject.next(true);
    dc.onclose = () => this.chatDisponibleSubject.next(false);
    dc.onmessage = (ev) => this.recibirChat(ev.data);
  }

  private recibirChat(data: string): void {
    try {
      const msg = JSON.parse(data);
      this.chatMensajesSubject.next([
        ...this.chatMensajesSubject.value,
        { texto: String(msg.texto ?? ''), propio: false, hora: this.horaActual() }
      ]);
    } catch { /* mensaje malformado, ignorar */ }
  }

  private horaActual(): string {
    return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  /** Envía un mensaje de chat al ciudadano por el canal de datos P2P. */
  enviarChat(texto: string): void {
    const limpio = texto.trim();
    if (!limpio || !this.dataChannel || this.dataChannel.readyState !== 'open') return;
    this.dataChannel.send(JSON.stringify({ texto: limpio }));
    this.chatMensajesSubject.next([
      ...this.chatMensajesSubject.value,
      { texto: limpio, propio: true, hora: this.horaActual() }
    ]);
  }

  /** Silencia/reactiva el micrófono del despachador sin renegociar la conexión. */
  toggleMicrofono(): void {
    const track = this.micStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    this.microfonoActivoSubject.next(track.enabled);
  }

  /** Graba lo que se está recibiendo (MediaRecorder) — se sube al backend al colgar. */
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  iniciarGrabacion(): void {
    const stream = this.remoteStreamSubject.value;
    if (!stream) return;
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.recorder.start();
  }

  async detenerYSubirGrabacion(pedidoId: string, sitioGraba: number): Promise<void> {
    if (!this.recorder) return;
    const grabacionLista = new Promise<void>((resolve) => {
      this.recorder!.onstop = () => resolve();
    });
    this.recorder.stop();
    await grabacionLista;

    if (this.chunks.length === 0) return;
    const blob = new Blob(this.chunks, { type: 'video/webm' });
    const form = new FormData();
    form.append('file', blob, `videollamada_${this.sesionId}.webm`);
    form.append('pedidoId', pedidoId);
    form.append('sitioGraba', String(sitioGraba));
    form.append('canalOrigen', 'VIDEOLLAMADA');
    form.append('sesionId', this.sesionId);

    await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/Adjunto/subir-video`, form));
  }

  async colgar(): Promise<void> {
    if (this.hub && this.sesionId) {
      try { await this.hub.invoke('EndSession', this.sesionId); } catch { /* la conexión ya pudo haberse caído */ }
    }
    this.finalizarLocal();
  }

  private finalizarLocal(): void {
    this.pc?.close();
    this.pc = null;
    this.hub?.stop();
    this.hub = null;
    this.dataChannel?.close();
    this.dataChannel = null;
    this.micStream?.getTracks().forEach(t => t.stop());
    this.micStream = null;
    this.remoteStreamSubject.next(null);
    this.chatMensajesSubject.next([]);
    this.chatDisponibleSubject.next(false);
    this.microfonoActivoSubject.next(true);
    this.estadoSubject.next('finalizada');
  }
}
