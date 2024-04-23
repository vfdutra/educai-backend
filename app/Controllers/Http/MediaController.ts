import Env from '@ioc:Adonis/Core/Env';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Application from '@ioc:Adonis/Core/Application';
import OpenAI from 'openai';
import { createCanvas } from 'canvas';
import sharp from 'sharp';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

export default class MediaController {
  public async generateTextCreateSlidesAndConvertToVideo({ request, response }: HttpContextContract) {
    const audioPath = Application.tmpPath('audio.mp3');
    const prompt = request.input('prompt');
    if (!prompt) {
      return response.badRequest({ message: 'Prompt is required' });
    }

    try {
      const openai = new OpenAI({
        apiKey: Env.get('CHATGPT_API_KEY'),
      });

      const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-3.5-turbo',
        max_tokens: 60,
      });

      const text = chatCompletion.choices[0].message.content;

      const canvas = createCanvas(1280, 720);
      const ctx = canvas.getContext('2d');
      ctx.font = '30px Arial';
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text ?? '', canvas.width / 2, canvas.height / 2);
      const slidesBuffer = canvas.toBuffer('image/png');

      if (!Env.get('GOOGLE_APPLICATION_CREDENTIALS')) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.');
      }

      const ttsClient = new TextToSpeechClient();
      const ttsRequest: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text },
        voice: { languageCode: 'pt-BR', ssmlGender: 'NEUTRAL' as const },
        audioConfig: { audioEncoding: 'MP3' as const },
      };

      const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
      if (ttsResponse.audioContent) {
        await fs.promises.writeFile(audioPath, ttsResponse.audioContent, 'binary');
      } else {
        throw new Error('No audio content received');
      }

      const slidePath = Application.tmpPath('slide.png');
      await sharp(slidesBuffer).toFile(slidePath);

      const outputVideoPath = Application.tmpPath('output.mp4');
      ffmpeg()
        .input(slidePath)
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-preset slow',
          '-crf 18',
          '-r 25',
        ])
        .output(outputVideoPath)
        .on('end', () => response.download(outputVideoPath))
        .run();

    } catch (error) {
      console.error('Error:', error);
      return response.status(500).send({ message: 'Failed to generate video presentation.' });
    }
  }
}
