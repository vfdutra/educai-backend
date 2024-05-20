import Env from '@ioc:Adonis/Core/Env';
import OpenAI from 'openai';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import { Buffer } from 'buffer';
import PptxGenJS from 'pptxgenjs';

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
          { role: 'system', content: 'Generate a structured JSON formatted presentation with titles, paragraphs, and lists for each slide. Each slide should have a title and may contain multiple paragraphs and/or lists.' },
          { role: 'user', content: prompt }
        ],
        model: 'gpt-3.5-turbo',
        max_tokens: 2048,
      });

      const content = chatCompletion.choices[0].message?.content;
      if (!content) {
        return response.status(400).send('No content generated from the prompt');
      }

      let slidesData;
      try {
        slidesData = JSON.parse(content);
      } catch (error) {
        return response.status(400).send('Failed to parse JSON content');
      }

      if (!slidesData.slides || !Array.isArray(slidesData.slides)) {
        return response.status(400).send('Invalid content structure');
      }

      const buffer = await this.createPptxBuffer(slidesData.slides);

      response.header('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      response.header('Content-Disposition', 'attachment; filename="slide.pptx"');
      response.send(buffer);
    } catch (error) {
      console.error('Error generating presentation:', error);
      return response.internalServerError({ error: 'Failed to generate presentation' });
    }
  }

  private createPptxBuffer(slides: { title: string, paragraphs?: string[], lists?: { title: string, items: string[] }[] }[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pptx = new PptxGenJS();

      slides.forEach(slideData => {
        const slide = pptx.addSlide();
        slide.addText(slideData.title, { x: 0.5, y: 0.5, fontSize: 32 });

        let yOffset = 1.5;

        // Adicionar parágrafos
        if (slideData.paragraphs && Array.isArray(slideData.paragraphs)) {
          slideData.paragraphs.forEach(paragraph => {
            slide.addText(paragraph, { x: 0.5, y: yOffset, fontSize: 24 });
            yOffset += 0.5;
          });
        }

        // Adicionar listas
        if (slideData.lists && Array.isArray(slideData.lists)) {
          slideData.lists.forEach(list => {
            slide.addText(list.title, { x: 0.5, y: yOffset, fontSize: 28, bold: true });
            yOffset += 0.5;
            list.items.forEach((item) => {
              slide.addText(`• ${item}`, { x: 1, y: yOffset, fontSize: 24 });
              yOffset += 0.5;
            });
          });
        }
      });

      pptx.write({ outputType: 'arraybuffer' }).then((data: ArrayBuffer) => {
        const buffer = Buffer.from(data);
        resolve(buffer);
      }).catch((err: any) => {
        reject(err);
      });
    });
  }
}
