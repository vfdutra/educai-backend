import Env from '@ioc:Adonis/Core/Env';
import OpenAI from 'openai';
import officegen from 'officegen';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Application from '@ioc:Adonis/Core/Application';
import fs from 'fs';
import path from 'path';

export default class PresentationsController {
  public async generatePresentation({ request, response }: HttpContextContract) {
    const prompt = request.input('prompt');
    if (!prompt) {
      return response.badRequest({ message: 'Prompt is required' });
    }

    const openai = new OpenAI({
      apiKey: Env.get('CHATGPT_API_KEY')
    });

    try {
      const chatCompletion = await openai.chat.completions.create({
        messages: [
          { role: 'system', content: 'Format the following text as HTML for slides.' },
          { role: 'user', content: prompt }
        ],
        model: 'gpt-3.5-turbo',
        max_tokens: 1024,
      });

      const content = chatCompletion.choices[0].message.content;
      const slidesContent = content?.split('<slide>').slice(1);

      let pptx = officegen('pptx');

      slidesContent?.forEach(slideContent => {
        if (slideContent) {
          let slide = pptx.makeNewSlide();
          slide.addText(slideContent.trim(), { x: 0.0, y: 0.0, w: '100%', h: '100%', align: 'center' });
        }
      });

      const pptxPath = path.join(Application.tmpPath(), 'presentation.pptx');
      const outStream = fs.createWriteStream(pptxPath, { flags: 'w' });

      pptx.generate(outStream, {
        finalize: function () {
          response.header('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
          response.header('Content-Disposition', 'attachment; filename="presentation.pptx"');
          response.download(pptxPath);
        },
        error: function (err) {
          console.error('Erro ao gerar o PPTX:', err);
          response.internalServerError({ message: 'Erro ao gerar a apresentação.' });
        }
      });

    } catch (error) {
      console.error(error);
      return response.status(500).send({ message: 'Failed to generate presentation' });
    }
  }
}
