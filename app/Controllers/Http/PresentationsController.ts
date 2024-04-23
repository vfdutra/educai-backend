import Env from '@ioc:Adonis/Core/Env';
import OpenAI from 'openai';
import officegen from 'officegen';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Application from '@ioc:Adonis/Core/Application';
import fs from 'fs';

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
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-3.5-turbo',
        max_tokens: 150,
      });

      const content = chatCompletion.choices[0].message.content;
      const paragraphs = (content || '').split('\n');

      let pptx = officegen('pptx');

      paragraphs.forEach(paragraph => {
        if (paragraph) { 
          let slide = pptx.makeNewSlide();
          slide.addText(paragraph, { x: 0.0, y: 0.0, w: '100%', h: '100%', align: 'center' });
        }
      });

      const filePath = Application.tmpPath('presentation.pptx');
      let stream = fs.createWriteStream(filePath);
      pptx.generate(stream);
      
      stream.on('close', () => {
        response.download(filePath, true);
      });

    } catch (error) {
      console.error(error);
      return response.status(500).send({ message: 'Failed to generate presentation' });
    }
  }
}
