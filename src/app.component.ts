
import { Component, ChangeDetectionStrategy, signal, inject, ElementRef, viewChild, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from './services/gemini.service';

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  image?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [GeminiService],
})
export class AppComponent {
  private readonly geminiService = inject(GeminiService);
  private readonly chatContainer = viewChild<ElementRef<HTMLDivElement>>('chatContainer');

  readonly messages = signal<ChatMessage[]>([]);
  readonly uploadedImage = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sessionStarted = signal(false);

  constructor() {
    afterNextRender(() => {
        this.scrollToBottom();
    });
  }

  private scrollToBottom(): void {
    const container = this.chatContainer()?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.error.set('Please select a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const base64Image = (e.target?.result as string).split(',')[1];
      if (base64Image) {
        this.uploadedImage.set(e.target?.result as string);
        this.sessionStarted.set(true);
        this.isLoading.set(true);
        this.error.set(null);
        this.messages.set([{ sender: 'user', text: 'Here is my math problem:', image: this.uploadedImage()! }]);
        
        try {
          const firstStep = await this.geminiService.startTutoringSession(base64Image, file.type);
          this.messages.update(m => [...m, { sender: 'ai', text: firstStep }]);
        } catch (err) {
          console.error(err);
          this.error.set('An error occurred while analyzing the image. Please try again.');
          this.resetSession();
        } finally {
          this.isLoading.set(false);
          this.scrollToBottomAfterRender();
        }
      }
    };
    reader.readAsDataURL(file);
  }

  async handleWhy(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.messages.update(m => [...m, { sender: 'user', text: 'Why did we do that?' }]);
    this.scrollToBottomAfterRender();

    try {
      const explanation = await this.geminiService.askForExplanation();
      this.messages.update(m => [...m, { sender: 'ai', text: explanation }]);
    } catch (err) {
      console.error(err);
      this.error.set('An error occurred while getting an explanation. Please try again.');
    } finally {
      this.isLoading.set(false);
      this.scrollToBottomAfterRender();
    }
  }

  async handleNextStep(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.messages.update(m => [...m, { sender: 'user', text: "What's the next step?" }]);
    this.scrollToBottomAfterRender();
    
    try {
      const nextStep = await this.geminiService.askForNextStep();
      this.messages.update(m => [...m, { sender: 'ai', text: nextStep }]);
    } catch (err) {
      console.error(err);
      this.error.set('An error occurred while getting the next step. Please try again.');
    } finally {
      this.isLoading.set(false);
      this.scrollToBottomAfterRender();
    }
  }
  
  private scrollToBottomAfterRender() {
    setTimeout(() => this.scrollToBottom(), 0);
  }

  resetSession(): void {
    this.messages.set([]);
    this.uploadedImage.set(null);
    this.isLoading.set(false);
    this.error.set(null);
    this.sessionStarted.set(false);
    this.geminiService.reset();
  }
}
