import Env from '@ioc:Adonis/Core/Env';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import OpenAI from 'openai';

export default class QuizController {
  public async generateQuiz({ request, response }: HttpContextContract) {
    const theme = request.input('theme');
    const numberOfQuestions = parseInt(request.input('numberOfQuestions'));

    if (!theme || numberOfQuestions <= 0) {
      return response.badRequest({ message: 'Theme and a valid number of questions are required' });
    }

    try {
      const openai = new OpenAI({
        apiKey: Env.get('CHATGPT_API_KEY'),
      });

      const questions: string[] = [];
      for (let i = 0; i < numberOfQuestions; i++) {
        const questionPrompt = `Create a quiz question about ${theme}.`;
        const chatCompletion = await openai.chat.completions.create({
          messages: [{ role: 'user', content: questionPrompt }],
          model: 'gpt-3.5-turbo',
          max_tokens: 100,
        });

        const questionText = chatCompletion.choices[0].message.content ?? "No question generated.";
        questions.push(questionText);
      }

      return response.ok({
        theme,
        questions
      });

    } catch (error) {
      console.error('Error:', error);
      return response.status(500).send({ message: 'Failed to generate quiz questions.' });
    }
  }
}
