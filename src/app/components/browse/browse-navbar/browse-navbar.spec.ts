import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowseNavbarComponent } from './browse-navbar';
import { provideRouter } from '@angular/router';

describe('BrowseNavbarComponent', () => {
  let fixture: ComponentFixture<BrowseNavbarComponent>;
  let component: BrowseNavbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrowseNavbarComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    fixture   = TestBed.createComponent(BrowseNavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('should show search box when showSearch is true', () => {
    component.showSearch.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.search-box')).toBeTruthy();
  });

  it('should emit search event on input', () => {
    let emitted = '';
    component.search.subscribe((v: string) => emitted = v);
    component.showSearch.set(true);
    fixture.detectChanges();
    component.searchQuery = 'Vikram';
    component.search.emit('Vikram');
    expect(emitted).toBe('Vikram');
  });
});
