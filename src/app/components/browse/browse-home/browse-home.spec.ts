import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowseHomeComponent } from './browse-home';
import { BrowseStore } from '../../../services/browse.store';
import { BrowseToastService } from '../../../services/browse-toast.service';
import { provideRouter } from '@angular/router';

describe('BrowseHomeComponent', () => {
  let fixture: ComponentFixture<BrowseHomeComponent>;
  let component: BrowseHomeComponent;
  let store: BrowseStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrowseHomeComponent],
      providers: [provideRouter([]), BrowseStore, BrowseToastService]
    }).compileComponents();
    fixture   = TestBed.createComponent(BrowseHomeComponent);
    component = fixture.componentInstance;
    store     = TestBed.inject(BrowseStore);
    fixture.detectChanges();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('showDefault should be true initially', () => {
    expect(component.showDefault()).toBe(true);
  });

  it('search should filter movies', () => {
    component.onSearch('Vikram');
    expect(component.isSearching()).toBe(true);
    expect(component.searchResults().some(m => m.title === 'Vikram')).toBe(true);
  });

  it('activeLanguages should update when movie with new language is added', () => {
    const before = store.activeLanguages().length;
    store.addLanguage('Odia');
    store.addMovie({
      title:'Test', description:'', director:'', releaseYear:2024,
      pricePerDay:10, thumbnail:'', videoUrl:'', language:'Odia',
      genres:['Drama'], isTrending:false, isNew:false, topTen:false
    });
    expect(store.activeLanguages()).toContain('Odia');
    expect(store.activeLanguages().length).toBeGreaterThan(before);
    const added = store.movies().find(m => m.title === 'Test');
    if (added) store.deleteMovie(added.id);
    store.removeLanguage('Odia');
  });

  it('category filter should return correct movies', () => {
    component.onCategorySelect('trending');
    expect(component.categoryMovies().every(m => m.isTrending)).toBe(true);
  });
});
