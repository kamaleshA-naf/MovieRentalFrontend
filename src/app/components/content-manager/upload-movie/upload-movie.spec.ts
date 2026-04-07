// ─────────────────────────────────────────────────────────────
// src/app/components/content-manager/upload-movie/upload-movie.spec.ts
// Fix: import UploadMovieComponent, not UploadMovie
// ─────────────────────────────────────────────────────────────
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UploadMovieComponent } from './upload-movie';   // ← FIXED: was 'UploadMovie'

describe('UploadMovieComponent', () => {
  let component: UploadMovieComponent;
  let fixture: ComponentFixture<UploadMovieComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadMovieComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UploadMovieComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});