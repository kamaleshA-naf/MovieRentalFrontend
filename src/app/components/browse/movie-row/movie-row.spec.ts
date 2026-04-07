import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MovieRowComponent } from './movie-row';
import { BrowseStore } from '../../../services/browse.store';
import { BrowseToastService } from '../../../services/browse-toast.service';

describe('MovieRowComponent', () => {
  let fixture: ComponentFixture<MovieRowComponent>;
  let component: MovieRowComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovieRowComponent],
      providers: [BrowseStore, BrowseToastService]
    }).compileComponents();
    fixture   = TestBed.createComponent(MovieRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Test Row');
    fixture.componentRef.setInput('movies', []);
    fixture.detectChanges();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('should show empty message when movies is empty', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.empty-row')).toBeTruthy();
  });

  it('should render cards when movies provided', () => {
    const store = TestBed.inject(BrowseStore);
    fixture.componentRef.setInput('movies', store.movies().slice(0, 3));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('app-browse-card').length).toBe(3);
  });
});
