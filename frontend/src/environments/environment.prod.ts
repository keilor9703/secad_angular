export const environment = {
  production: true,
  apiBaseUrl: '/api',
  mediaBaseUrl: 'http://srvdockergusof.policia.gov.co:8088',
  sliderApiUrl: 'http://srvdockergusof.policia.gov.co:8088/api/Slider',
  sliderMediaBaseUrl: 'http://srvdockergusof.policia.gov.co:8088',
  noticiaApiUrl: 'http://srvdockergusof.policia.gov.co:8088/api/Noticia',
  radioApiUrl: 'http://srvdockergusof.policia.gov.co:8088/api/Radio',
  modalApiUrl: 'http://srvdockergusof.policia.gov.co:8088/api/Modal',
  eventoApiUrl: 'http://srvdockergusof.policia.gov.co:8088/api/Evento',
  eventoMediaBaseUrl: 'http://srvdockergusof.policia.gov.co:8088',
  videoInstitucionalApiUrl: 'http://srvdockergusof.policia.gov.co:8088/api/VideoInstitucional',
  // Servidor TURN propio (coturn) desplegado en el mismo servidor OCI, para
  // que la videollamada con el ciudadano atraviese NAT simétrico de
  // operadores celulares — ver video-llamada.service.ts. Esta credencial de
  // TURN de larga duración queda visible en el bundle JS público (es
  // inevitable: el navegador del ciudadano/despachador la necesita para
  // autenticar el ALLOCATE) — riesgo aceptado por ahora; para endurecerlo
  // más adelante se puede migrar a credenciales efímeras HMAC
  // (turnserver "use-auth-secret" + un endpoint del backend que las emita).
  turnUrls: ['turn:129.80.243.118:3478?transport=udp', 'turn:129.80.243.118:3478?transport=tcp'],
  turnUsername: 'secad',
  turnCredential: '6KpIEJuDnU/gzWJiDztD0UFiaUUYAn98'
};