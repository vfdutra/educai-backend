import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env';
import OpenAI from 'openai';

export default class ClassPlansController {
  public async generateClassPlan({ request, response }: HttpContextContract) {
    const prompt = request.input('prompt');
    if (!prompt) {
      return response.badRequest({ message: 'Prompt is required' });
    }

    try {
      const openai = new OpenAI({
        apiKey: Env.get('CHATGPT_API_KEY'),
      });

      const chatCompletion = await openai.chat.completions.create({
        messages: [
          { role: 'system', content: 'Format the following text as an HTML document.' },
          { role: 'user', content: prompt },
        ],
        model: 'gpt-3.5-turbo',
        max_tokens: 1024,
      });

      const lessonPlanContent = chatCompletion.choices[0].message.content;

      return response.ok({ lessonPlan: lessonPlanContent });
    } catch (error) {
      return response.status(500).send({ message: 'Failed to generate lesson plan.' });
    }
  }
}
