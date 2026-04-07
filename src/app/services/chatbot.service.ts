import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@env/environment';

export interface ChatResponse {
  answer: string;
}

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private http = inject(HttpClient);
  private readonly API = environment.apiBase;

  ask(userInput: string): Observable<ChatResponse> {
    // Backend expects: { movieTitle: string, question: string }
    // User types things like:
    //   "vadachennai summary"
    //   "who is the hero in Inception"
    //   "plot of 3 idiots"
    const { movieTitle, question } = this.parseInput(userInput);

    return this.http
      .post<ChatResponse>(`${this.API}/Chatbot/ask`, { movieTitle, question })
      .pipe(
        catchError(() => of({
          answer: 'Sorry, the assistant is temporarily unavailable. Please try again later.'
        }))
      );
  }

  /**
   * Parse free-form user input into movieTitle + question.
   *
   * Patterns handled:
   *  "vadachennai summary"           → title: "vadachennai",  question: "summary"
   *  "who is the hero in Inception"  → title: "Inception",    question: "who is the hero"
   *  "plot of 3 idiots"              → title: "3 idiots",     question: "plot"
   *  "Interstellar cast"             → title: "Interstellar", question: "cast"
   *  "tell me about KGF"             → title: "KGF",          question: "tell me about"
   */
  private parseInput(input: string): { movieTitle: string; question: string } {
    const text = input.trim();

    // Pattern 1: "... in <Movie Title>" — e.g. "who is the hero in Inception"
    const inMatch = text.match(/^(.+?)\s+in\s+(.+)$/i);
    if (inMatch) {
      return { movieTitle: inMatch[2].trim(), question: inMatch[1].trim() };
    }

    // Pattern 2: "... of <Movie Title>" — e.g. "plot of 3 idiots"
    const ofMatch = text.match(/^(.+?)\s+of\s+(.+)$/i);
    if (ofMatch) {
      return { movieTitle: ofMatch[2].trim(), question: ofMatch[1].trim() };
    }

    // Pattern 3: "tell me about <Movie Title>"
    const aboutMatch = text.match(/^tell\s+me\s+about\s+(.+)$/i);
    if (aboutMatch) {
      return { movieTitle: aboutMatch[1].trim(), question: 'summary' };
    }

    // Pattern 4: "what is <Movie Title> about"
    const whatMatch = text.match(/^what\s+is\s+(.+?)\s+about\??$/i);
    if (whatMatch) {
      return { movieTitle: whatMatch[1].trim(), question: 'summary' };
    }

    // Pattern 5: "<Movie Title> <question keyword>"
    // Keywords that are clearly questions, not part of a title
    const keywords = [
      'summary', 'plot', 'cast', 'hero', 'villain', 'director',
      'release', 'rating', 'genre', 'language', 'review', 'story',
      'actors', 'actress', 'budget', 'collection', 'trailer', 'similar'
    ];

    const words = text.split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const tail = words.slice(i).join(' ').toLowerCase();
      if (keywords.some(k => tail.startsWith(k))) {
        return {
          movieTitle: words.slice(0, i).join(' '),
          question:   words.slice(i).join(' ')
        };
      }
    }

    // Fallback: treat entire input as the question, no specific title
    return { movieTitle: '', question: text };
  }
}
