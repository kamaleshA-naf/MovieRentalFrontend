import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryPanelComponent } from './category-panel';
import { BrowseStore } from '../../../services/browse.store';
import { BrowseToastService } from '../../../services/browse-toast.service';

describe('CategoryPanelComponent', () => {
  let fixture: ComponentFixture<CategoryPanelComponent>;
  let store: BrowseStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryPanelComponent],
      providers: [BrowseStore, BrowseToastService]
    }).compileComponents();
    fixture = TestBed.createComponent(CategoryPanelComponent);
    store   = TestBed.inject(BrowseStore);
    fixture.detectChanges();
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());

  it('should render language buttons from store', () => {
    const el: HTMLElement = fixture.nativeElement;
    const buttons = el.querySelectorAll('.cat-item');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should reflect new language added to store', () => {
    store.addLanguage('Odia');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Odia');
    store.removeLanguage('Odia');
  });
});
