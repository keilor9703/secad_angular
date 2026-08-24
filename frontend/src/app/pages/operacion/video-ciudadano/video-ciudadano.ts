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

  readonly estado = signal<EstadoPagina>('validando');
  readonly mensajeError = signal('');

  private readonly token: string;
  private sesionId = '';
  private hub: signalR.HubConnection | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;

  private readonly iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' }
  ];

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
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      this.estado.set('permiso-denegado');
      return;
    }

    const videoLocalRef = this.videoLocalRef();
    if (videoLocalRef) videoLocalRef.nativeElement.srcObject = this.localStream;

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
    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

    this.localStream?.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));

    this.pc.onicecandidate = (ev) => {
      if (ev.candidate && this.hub) {
        this.hub.invoke('SendIceCandidate', this.sesionId, JSON.stringify(ev.candidate));
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'connected') this.estado.set('conectada');
    };
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
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    if (this.estado() !== 'invalido' && this.estado() !== 'permiso-denegado') this.estado.set('finalizada');
  }
}
