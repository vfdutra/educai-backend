import Env from '@ioc:Adonis/Core/Env';
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import OpenAI from 'openai';

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}

export default class QuizController {
  public async generateQuiz({ request, response }: HttpContextContract) {
    const theme = request.input('theme');
    const numberOfQuestions = parseInt(request.input('numberOfQuestions'));
    const numberOfOptions = parseInt(request.input('numberOfOptions', '4'));

    if (!theme || numberOfQuestions <= 0 || numberOfOptions <= 0) {
      return response.badRequest({ message: 'Theme, a valid number of questions, and a valid number of options are required' });
    }

    try {
      const openai = new OpenAI({
        apiKey: Env.get('CHATGPT_API_KEY'),
      });

      const quiz: QuizQuestion[] = [];
      for (let i = 0; i < numberOfQuestions; i++) {
        const questionPrompt = `
          Create a multiple-choice quiz question about ${theme}. 
          Provide ${numberOfOptions} options and specify the correct answer. 
          Format the response as: 
          {
            "question": "Your question?",
            "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
            "answer": "Correct Option"
          }
        `;
        const chatCompletion = await openai.chat.completions.create({
          messages: [{ role: 'user', content: questionPrompt }],
          model: 'gpt-3.5-turbo',
          max_tokens: 200,
        });

        const questionData: QuizQuestion = JSON.parse(chatCompletion.choices[0].message.content || '{}');
        if (!questionData.question || !questionData.options || !questionData.answer) {
          return response.internalServerError({ message: 'Failed to generate valid quiz question.' });
        }
        quiz.push(questionData);
      }

      return response.ok({
        theme,
        questions: quiz
      });

    } catch (error) {
      console.error('Error:', error);
      return response.status(500).send({ message: 'Failed to generate quiz questions.' });
    }
  }
}
