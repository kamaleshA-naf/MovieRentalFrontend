import {
  Component, signal, inject, ViewChild, ElementRef,
  AfterViewChecked, Input, Output, EventEmitter, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { ChatbotService } from '../../../services/chatbot.service';

interface Message {
  role: 'user' | 'bot';
  text: string;
  isError?: boolean;
}

const SUGGESTIONS = ['Vadachennai summary', 'Hero of Inception', 'Plot of 3 Idiots', 'Cast of KGF', 'Director of Interstellar'];
const GREETING    = "Hi! I'm your Movie Assistant. Ask me anything — try \"Vadachennai summary\" or \"who is the hero in Inception\".";

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css'
})
export class ChatbotComponent implements AfterViewChecked, OnChanges {
  private chatSvc = inject(ChatbotService);
  auth            = inject(AuthService);

  @Input()  forceOpen = false;
  @Output() closed    = new EventEmitter<void>();

  isOpen    = signal(false);
  isTyping  = signal(false);
  userInput = signal('');
  messages  = signal<Message[]>([{ role: 'bot', text: GREETING }]);

  readonly suggestions = SUGGESTIONS;
  readonly placeholder = 'e.g. "Vadachennai summary" or "hero of Inception"';

  private shouldScroll = false;
  @ViewChild('msgContainer') private msgContainer!: ElementRef<HTMLElement>;

  ngOnChanges(c: SimpleChanges): void {
    if (c['forceOpen']) this.isOpen.set(this.forceOpen);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      try {
        const el = this.msgContainer?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      } catch {}
      this.shouldScroll = false;
    }
  }

  close(): void { this.isOpen.set(false); this.closed.emit(); }

  useSuggestion(s: string): void { this.userInput.set(s); this.send(); }

  send(): void {
    const text = this.userInput().trim();
    if (!text || this.isTyping()) return;

    this.messages.update(m => [...m, { role: 'user', text }]);
    this.userInput.set('');
    this.isTyping.set(true);
    this.shouldScroll = true;

    this.chatSvc.ask(text).subscribe({
      next: (res) => {
        const answer = res?.answer?.trim();
        const notFound = !answer
          || answer.toLowerCase().includes('not found')
          || answer.toLowerCase().includes('no movie')
          || answer.toLowerCase().includes("couldn't find")
          || answer.toLowerCase().includes('not in our catalog')
          || answer.toLowerCase().includes('not available');

        this.pushBot(
          notFound
            ? `I couldn't find that movie in our catalog. Try asking about a movie we have — e.g. "Who is the hero in Inception?" or "Plot of Interstellar".`
            : answer,
          false
        );
        this.isTyping.set(false);
      },
      error: () => {
        this.pushBot('Something went wrong. Please try again.', true);
        this.isTyping.set(false);
      }
    });
  }

  private pushBot(text: string, isError: boolean): void {
    this.messages.update(m => [...m, { role: 'bot', text, isError }]);
    this.shouldScroll = true;
  }

  onEnter(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); this.send(); }
  }

  clearChat(): void {
    this.messages.set([{ role: 'bot', text: GREETING }]);
  }
}
