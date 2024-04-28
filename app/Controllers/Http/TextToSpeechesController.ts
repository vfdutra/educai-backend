import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import OpenAI from 'openai';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';

export default class TextToSpeechController {
  public async generateAndConvert({ request, response }: HttpContextContract) {
    try {
      const prompt = request.input('prompt', '');
      if (!prompt) {
        return response.badRequest({ message: 'O prompt de texto é obrigatório.' });
      }

      const openai = new OpenAI({
        apiKey: process.env.CHATGPT_API_KEY,
      });

      const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-3.5-turbo',
        max_tokens: 1024,
      });

      const text = chatCompletion.choices[0].message.content?.trim() ?? '';
      if (!text) {
        return response.internalServerError({ message: 'Não foi possível gerar o texto a partir do prompt fornecido.' });
      }

      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error('A variável de ambiente GOOGLE_APPLICATION_CREDENTIALS não está definida.');
      }

      const client = new TextToSpeechClient();
      const ttsRequest: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text: text },
        voice: { languageCode: 'pt-BR', ssmlGender: 'NEUTRAL' as const },
        audioConfig: { audioEncoding: 'MP3' as const },
      };

      const [ttsResponse] = await client.synthesizeSpeech(ttsRequest);
      if (ttsResponse.audioContent) {
        response.response.setHeader('Content-Type', 'audio/mpeg');
        response.response.setHeader('Content-Disposition', `attachment; filename="output.mp3"`);
        return response.send(ttsResponse.audioContent);
      } else {
        console.error('Nenhum conteúdo de áudio foi recebido.');
        return response.internalServerError({ error: 'Nenhum conteúdo de áudio foi recebido.' });
      }
    } catch (error) {
      console.error('Erro ao gerar áudio:', error);
      return response.internalServerError({ error: 'Erro ao gerar áudio.' });
    }
  }
}
