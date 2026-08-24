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

  private readonly estadoSubject = new BehaviorSubject<EstadoLlamada>('inactiva');
  readonly estado$: Observable<EstadoLlamada> = this.estadoSubject.asObservable();

  private readonly remoteStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  readonly remoteStream$: Observable<MediaStream | null> = this.remoteStreamSubject.asObservable();

  private readonly errorSubject = new BehaviorSubject<string>('');
  readonly error$: Observable<string> = this.errorSubject.asObservable();

  // Servidores ICE — STUN público de Google como fallback de desarrollo.
  // En producción reemplazar por el TURN propio (coturn) vía variable de entorno;
  // sin TURN, muchas redes celulares con NAT de operador no logran conectar.
  private readonly iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' }
  ];

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
    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

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
    // Solo recibe (el despachador no envía su propia cámara) — el video es
    // unidireccional ciudadano → despachador, ver decisión de diseño.
    this.pc.addTransceiver('video', { direction: 'recvonly' });
    this.pc.addTransceiver('audio', { direction: 'sendrecv' });

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.hub.invoke('SendOffer', this.sesionId, offer.sdp);
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
    this.remoteStreamSubject.next(null);
    this.estadoSubject.next('finalizada');
  }
}
