using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace ofic.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RadioController : ControllerBase
    {
        private const string RadioStreamUrl = "https://radio.policia.gov.co:8080/inhouse";

        [HttpGet("stream")]
        [Produces("audio/mpeg")]
        [DisableRequestSizeLimit]
        [EnableCors]
        public async Task Stream()
        {
            try
            {
                Response.Headers.Append("Access-Control-Allow-Origin", "*");
                Response.Headers.Append("Access-Control-Expose-Headers", "*");
                Response.Headers.Append("Accept-Ranges", "bytes");

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromMinutes(30);
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                var request = new HttpRequestMessage(HttpMethod.Get, RadioStreamUrl);
                request.Headers.Add("Accept", "audio/mpeg, audio/*, */*");

                var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();

                var contentType = response.Content.Headers.ContentType?.ToString() ?? "audio/mpeg";
                Response.ContentType = contentType;

                using var stream = await response.Content.ReadAsStreamAsync();
                
                var buffer = new byte[81920];
                while (!Response.HttpContext.RequestAborted.IsCancellationRequested)
                {
                    var bytesRead = await stream.ReadAsync(buffer);
                    if (bytesRead == 0) break;
                    await Response.Body.WriteAsync(buffer.AsMemory(0, bytesRead));
                    await Response.Body.FlushAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Radio stream error: {ex.Message}");
                Response.StatusCode = 502;
                await Response.WriteAsync("Error connecting to radio stream");
            }
        }

        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            return Ok(new
            {
                name = "Radio Policía Nacional",
                url = RadioStreamUrl,
                status = "online",
                message = "Transmisión en vivo"
            });
        }
    }
}
