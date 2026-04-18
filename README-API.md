# SISGE - API de Integración

Este documento describe los endpoints públicos disponibles para consumo desde sistemas externos.

---

##Servidor Base

```
http://172.28.9.181:8088
```

---

##endpoints Públicos (Sin autenticación)

### 1. Banners / Slider

```
GET /api/Slider/Publicos
```

**Descripción:** Retorna la lista de banners/sliders activos y públicos.

**Respuesta:**
```json
[
  {
    "idSlider": 1,
    "titulo": "Banner Principal",
    "descripcion": "Descripción del banner",
    "imagenUrl": "/api/Slider/Image/archivo.jpg",
    "vigente": 1,
    "orden": 1
  }
]
```

---

### 2. Radio / Emisoras

```
GET /api/Radio
```

**Descripción:** Retorna la lista de emisoras de radio activas.

**Respuesta:**
```json
[
  {
    "idEmisora": 1,
    "nombre": "Policía Bogotá",
    "streamUrl": "https://radio.policia.gov.co:8080/inhouse",
    "logoUrl": "/api/Radio/logo/archivo.png",
    "vigente": 1
  }
]
```

---

### 3. Branding / Configuración

```
GET /api/Branding/config
```

**Descripción:** Retorna la configuración de marca del sistema (logo, nombre, favicon).

**Respuesta:**
```json
{
  "sistema": "OFTIC",
  "nombreSistema": "Oficina de Tecnología",
  "logoUrl": "/api/Branding/logo/archivo.png",
  "faviconUrl": "/api/Branding/favicon/archivo.ico"
}
```

---

## Ejemplos de Consumo

### .NET 8 / C#

```csharp
var client = new HttpClient();
client.BaseAddress = new Uri("http://172.28.9.181:8088");

// Banners
var banners = await client.GetFromJsonAsync<List<DtoSlider>>("/api/Slider/Publicos");

// Radio
var radios = await client.GetFromJsonAsync<List<DtoRadio>>("/api/Radio");

// Branding
var config = await client.GetFromJsonAsync<DtoBranding>("/api/Branding/config");
```

### JavaScript / TypeScript

```javascript
const BASE_URL = 'http://172.28.9.181:8088';

async function getBanners() {
  const res = await fetch(`${BASE_URL}/api/Slider/Publicos`);
  return await res.json();
}

async function getRadios() {
  const res = await fetch(`${BASE_URL}/api/Radio`);
  return await res.json();
}

async function getBranding() {
  const res = await fetch(`${BASE_URL}/api/Branding/config`);
  return await res.json();
}
```

### Python

```python
import requests

BASE_URL = 'http://172.28.9.181:8088'

# Banners
banners = requests.get(f'{BASE_URL}/api/Slider/Publicos').json()

# Radio  
radios = requests.get(f'{BASE_URL}/api/Radio').json()

# Branding
config = requests.get(f'{BASE_URL}/api/Branding/config').json()
```

### Java (OkHttp)

```java
OkHttpClient client = new OkHttpClient();

Request request = new Request.Builder()
    .url("http://172.28.9.181:8088/api/Slider/Publicos")
    .build();

Response response = client.newCall(request).execute();
String json = response.body().string();
```

### PHP

```php
// Banners
$banners = json_decode(
    file_get_contents('http://172.28.9.181:8088/api/Slider/Publicos'), 
    true
);

// Radio
$radios = json_decode(
    file_get_contents('http://172.28.9.181:8088/api/Radio'), 
    true
);

// Branding
$config = json_decode(
    file_get_contents('http://172.28.9.181:8088/api/Branding/config'), 
    true
);
```

### Angular (HttpClient)

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SisgeApiService {
  private baseUrl = 'http://172.28.9.181:8088';

  constructor(private http: HttpClient) {}

  getBanners() {
    return this.http.get<any[]>(`${this.baseUrl}/api/Slider/Publicos`);
  }

  getRadios() {
    return this.http.get<any[]>(`${this.baseUrl}/api/Radio`);
  }

  getBranding() {
    return this.http.get<any>(`${this.baseUrl}/api/Branding/config`);
  }
}
```

---

## ⚠️ Notas Importantes

1. **No requiere autenticación** - Los endpoints son públicos y accesibles sin token.

2. **CORS habilitado** - Se puede llamar desde cualquier dominio/frontend.

3. **URLs de imágenes** - Son relativas, prependir `http://172.28.9.181:8088` para obtener la URL completa:
   - Ejemplo: `/api/Slider/Image/archivo.jpg` → `http://172.28.9.181:8088/api/Slider/Image/archivo.jpg`

4. **Versión actual** - Esta documentación corresponde a la versión desplegada en producción.

---

## 📞 Soporte

Para consultas técnicas sobre la integración, contactar al equipo de desarrollo de OFTIC.