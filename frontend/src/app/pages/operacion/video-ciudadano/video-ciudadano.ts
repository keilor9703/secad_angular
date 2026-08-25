import { Component, ChangeDetectionStrategy, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../../environments/environment';

interface DtoVideoSesionPublica {
  valido: boolean;
  estado: string;
  mensaje: string;
  sesionId: string;
}

interface ChatMensaje {
  texto: string;
  propio: boolean;
  hora: string;
}

type EstadoPagina =
  | 'validando' | 'invalido' | 'pidiendo-permiso' | 'permiso-denegado'
  | 'esperando' | 'conectada' | 'finalizada' | 'error';

/**
 * Página pública a la que llega el ciudadano al tocar el enlace de la
 * videollamada (/video/:token). Sin autenticación — su única credencial es el
 * token de un solo uso incluido en la URL, validado en el backend antes de
 * pedir cámara/micrófono. Es el lado "responde" del WebRTC punto-a-punto:
 * recibe la oferta SDP del despachador y contesta con su answer.
 */
@Component({
  selector:    'app-video-ciudadano',
  standalone:  true,
  imports: [],
  templateUrl: './video-ciudadano.html',
  styleUrls:   ['./video-ciudadano.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoCiudadanoComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  readonly videoLocalRef = viewChild<ElementRef<HTMLVideoElement>>('videoLocal');
  readonly audioRemotoRef = viewChild<ElementRef<HTMLAudioElement>>('audioRemoto');

  readonly estado = signal<EstadoPagina>('validando');
  readonly mensajeError = signal('');
  readonly camaraFrontal = signal(false);
  readonly cambiandoCamara = signal(false);
  readonly chatMensajes = signal<ChatMensaje[]>([]);
  readonly chatDisponible = signal(false);
  readonly chatAbierto = signal(false);
  readonly chatTexto = signal('');

  private readonly token: string;
  private sesionId = '';
  private hub: signalR.HubConnection | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private facingModeActual: 'environment' | 'user' = 'environment';
  private dataChannel: RTCDataChannel | null = null;

  /** Ver comentario equivalente en video-llamada.service.ts (lado despachador). */
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

  constructor() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
  }

  ngOnInit(): void {
    if (!this.token) { this.estado.set('invalido'); return; }

    this.http.get<DtoVideoSesionPublica>(`${environment.apiBaseUrl}/VideoLlamada/publico/${this.token}`)
      .subscribe({
        next: (r) => {
          if (!r.valido) {
            this.estado.set('invalido');
            this.mensajeError.set(r.mensaje || 'Este enlace ya no es válido.');
            return;
          }
          this.sesionId = r.sesionId;
          this.pedirPermisos();
        },
        error: () => {
          this.estado.set('invalido');
          this.mensajeError.set('No fue posible validar el enlace.');
        }
      });
  }

  ngOnDestroy(): void {
    this.finalizarLocal();
  }

  private async pedirPermisos(): Promise<void> {
    this.estado.set('pidiendo-permiso');

    if (!navigator.mediaDevices?.getUserMedia) {
      // Los navegadores solo exponen getUserMedia en un "contexto seguro"
      // (HTTPS, o localhost) — si el enlace se abrió por HTTP en un host
      // distinto de localhost, la API ni siquiera existe y nunca se llega a
      // pedir el permiso nativo.
      this.mensajeError.set(
        'Este enlace debe abrirse con conexión segura (https://). Contacte al despachador para que verifique el enlace enviado.'
      );
      this.estado.set('permiso-denegado');
      return;
    }

    try {
      // La cámara trasera (environment) es la útil para mostrar la escena al
      // despachador — la frontal (selfie) es la que activan los navegadores
      // por defecto si no se pide explícitamente. "ideal" (no "exact") para
      // no fallar en equipos con una sola cámara (ej. laptops/PCs).
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: true
      });
    } catch (err) {
      const nombre = err instanceof DOMException ? err.name : '';
      // eslint-disable-next-line no-console
      console.error('[video-ciudadano] getUserMedia falló:', nombre, err);
      this.mensajeError.set(
        nombre === 'NotFoundError' || nombre === 'DevicesNotFoundError'
          ? 'No se encontró una cámara o micrófono en este dispositivo.'
          : nombre === 'NotReadableError' || nombre === 'TrackStartError'
            ? 'La cámara o el micrófono ya están siendo usados por otra aplicación (cierre otras videollamadas y vuelva a intentar).'
            : nombre === 'NotAllowedError' || nombre === 'PermissionDeniedError'
              ? 'El navegador o el sistema operativo bloquearon el acceso a la cámara/micrófono. Revise el ícono de candado junto a la dirección para habilitar ambos permisos, y también los ajustes de privacidad de cámara/micrófono del sistema operativo — luego recargue esta página.'
              : `No fue posible acceder a su cámara y micrófono (detalle técnico: ${nombre || 'desconocido'}). Verifique los permisos del navegador y vuelva a abrir el enlace.`
      );
      this.estado.set('permiso-denegado');
      return;
    }

    const videoLocalRef = this.videoLocalRef();
    if (videoLocalRef) {
      // El atributo HTML "muted" ya está puesto en la plantilla, pero se
      // fuerza también por JS (defensivo): algunos navegadores móviles no
      // garantizan que la propiedad quede en sync con el atributo cuando el
      // srcObject se asigna dinámicamente después del render inicial, lo que
      // puede hacer que el ciudadano escuche su propia voz por el parlante.
      videoLocalRef.nativeElement.muted = true;
      videoLocalRef.nativeElement.srcObject = this.localStream;
    }

    await this.conectar();
  }

  private async conectar(): Promise<void> {
    this.estado.set('esperando');

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiBaseUrl}/hubs/video`)
      .withAutomaticReconnect()
      .build();

    this.hub.on('error', (msg: string) => {
      this.mensajeError.set(msg);
      this.estado.set('error');
    });

    this.hub.on('offer', async (sdp: string) => {
      this.prepararPeerConnection();
      await this.pc!.setRemoteDescription({ type: 'offer', sdp });
      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);
      await this.hub!.invoke('SendAnswer', this.sesionId, answer.sdp);
    });

    this.hub.on('ice-candidate', async (candidateJson: string) => {
      if (!this.pc) return;
      try { await this.pc.addIceCandidate(JSON.parse(candidateJson)); } catch { /* candidato tardío, ignorar */ }
    });

    this.hub.on('sesion-finalizada', () => this.finalizarLocal());

    try {
      await this.hub.start();
      await this.hub.invoke('JoinAsCiudadano', this.token);
    } catch {
      this.estado.set('error');
      this.mensajeError.set('No fue posible conectar con el despachador.');
    }
  }

  private prepararPeerConnection(): void {
    this.pc = new RTCPeerConnection({ iceServers: this.construirIceServers() });

    this.localStream?.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));

    // Audio del despachador (el CAD le habla al ciudadano) — sin este
    // handler el audio entrante llega por WebRTC pero nunca se reproduce en
    // ningún lado: el ciudadano nunca escucha nada del CAD.
    this.pc.ontrack = (ev) => {
      const audioRef = this.audioRemotoRef();
      if (!audioRef) return;
      audioRef.nativeElement.srcObject = ev.streams[0] ?? new MediaStream([ev.track]);
      audioRef.nativeElement.play().catch(err => {
        // eslint-disable-next-line no-console
        console.error('[video-ciudadano] no se pudo reproducir el audio del despachador:', err);
      });
    };

    // Chat de texto P2P — el despachador (offerer) crea el canal; el
    // ciudadano solo lo recibe. Permite escribir sin hablar (p. ej. si no
    // puede recibir sonido del CAD sin delatarse ante un agresor).
    this.pc.ondatachannel = (ev) => this.configurarDataChannel(ev.channel);

    this.pc.onicecandidate = (ev) => {
      if (ev.candidate && this.hub) {
        this.hub.invoke('SendIceCandidate', this.sesionId, JSON.stringify(ev.candidate));
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'connected') this.estado.set('conectada');
    };
  }

  async cambiarCamara(): Promise<void> {
    if (!this.localStream || this.cambiandoCamara()) return;
    this.cambiandoCamara.set(true);

    const nuevoFacingMode: 'environment' | 'user' = this.facingModeActual === 'environment' ? 'user' : 'environment';

    try {
      const nuevoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nuevoFacingMode } },
        audio: false
      });
      const nuevoTrack = nuevoStream.getVideoTracks()[0];
      const trackViejo = this.localStream.getVideoTracks()[0];

      if (trackViejo) {
        this.localStream.removeTrack(trackViejo);
        trackViejo.stop();
      }
      this.localStream.addTrack(nuevoTrack);

      const sender = this.pc?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(nuevoTrack);

      const videoLocalRef = this.videoLocalRef();
      if (videoLocalRef) {
        videoLocalRef.nativeElement.muted = true;
        videoLocalRef.nativeElement.srcObject = this.localStream;
      }

      this.facingModeActual = nuevoFacingMode;
      this.camaraFrontal.set(nuevoFacingMode === 'user');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[video-ciudadano] no se pudo cambiar de cámara:', err);
    } finally {
      this.cambiandoCamara.set(false);
    }
  }

  private configurarDataChannel(dc: RTCDataChannel): void {
    this.dataChannel = dc;
    dc.onopen = () => this.chatDisponible.set(true);
    dc.onclose = () => this.chatDisponible.set(false);
    dc.onmessage = (ev) => this.recibirChat(ev.data);
  }

  private recibirChat(data: string): void {
    try {
      const msg = JSON.parse(data);
      this.chatMensajes.update(actuales => [
        ...actuales,
        { texto: String(msg.texto ?? ''), propio: false, hora: this.horaActual() }
      ]);
      this.chatAbierto.set(true);
    } catch { /* mensaje malformado, ignorar */ }
  }

  private horaActual(): string {
    return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  toggleChat(): void {
    this.chatAbierto.update(v => !v);
  }

  enviarChat(): void {
    const texto = this.chatTexto().trim();
    if (!texto || !this.dataChannel || this.dataChannel.readyState !== 'open') return;
    this.dataChannel.send(JSON.stringify({ texto }));
    this.chatMensajes.update(actuales => [...actuales, { texto, propio: true, hora: this.horaActual() }]);
    this.chatTexto.set('');
  }

  colgar(): void {
    if (this.hub && this.sesionId) {
      try { this.hub.invoke('EndSession', this.sesionId); } catch { /* la conexión ya pudo haberse caído */ }
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
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    const audioRef = this.audioRemotoRef();
    if (audioRef) audioRef.nativeElement.srcObject = null;
    if (this.estado() !== 'invalido' && this.estado() !== 'permiso-denegado') this.estado.set('finalizada');
  }
}
