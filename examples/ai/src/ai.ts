import type {GenerativeModel} from '@google/generative-ai';
import {GoogleGenerativeAI} from '@google/generative-ai';

export function createGoogleAI(): GoogleGenerativeAI {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY environment variable is not set');
	}
	const genAI = new GoogleGenerativeAI(apiKey);
	return genAI;
}

export async function* tellMeAStory(model: GenerativeModel, {topic}: {topic: string | undefined}) {
	const prompt = `Write a story about ${topic}`;

	const result = await model.generateContentStream(prompt);

	// Print text as it comes in.
	for await (const chunk of result.stream) {
		const chunkText = chunk.text();
		yield chunkText;
	}
}
