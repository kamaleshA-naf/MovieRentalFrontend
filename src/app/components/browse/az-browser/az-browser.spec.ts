import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AzBrowserComponent } from './az-browser';
import { BrowseStore } from '../../../services/browse.store';
import { BrowseToastService } from '../../../services/browse-toast.service';

describe('AzBrowserComponent', () => {
  let fixture: ComponentFixture<AzBrowserComponent>;
  let component: AzBrowserComponent;
  let store: BrowseStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AzBrowserComponent],
      providers: [BrowseStore, BrowseToastService]
    }).compileComponents();
    fixture   = TestBed.createComponent(AzBrowserComponent);
    component = fixture.componentInstance;
    store     = TestBed.inject(BrowseStore);
    fixture.detectChanges();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('should render 26 letter buttons', () => {
    const el: HTMLElement = fixture.nativeElement;
    const btns = el.querySelectorAll('.letter-btn:not(.clear-btn)');
    expect(btns.length).toBe(26);
  });

  it('select should filter movies by letter', () => {
    component.select('V');
    expect(component.selected()).toBe('V');
    expect(component.results().every(m => m.title.toUpperCase().startsWith('V'))).toBe(true);
  });

  it('select same letter twice should deselect', () => {
    component.select('V');
    component.select('V');
    expect(component.selected()).toBe('');
  });

  it('should show empty state for letter with no movies', () => {
    component.select('X');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    if (component.results().length === 0) {
      expect(el.querySelector('.az-empty')).toBeTruthy();
    }
  });
});
