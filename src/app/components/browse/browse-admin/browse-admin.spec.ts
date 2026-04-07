import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowseAdminComponent } from './browse-admin';
import { BrowseStore } from '../../../services/browse.store';
import { BrowseToastService } from '../../../services/browse-toast.service';
import { provideRouter } from '@angular/router';

describe('BrowseAdminComponent', () => {
  let fixture: ComponentFixture<BrowseAdminComponent>;
  let component: BrowseAdminComponent;
  let store: BrowseStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrowseAdminComponent],
      providers: [provideRouter([]), BrowseStore, BrowseToastService]
    }).compileComponents();
    fixture   = TestBed.createComponent(BrowseAdminComponent);
    component = fixture.componentInstance;
    store     = TestBed.inject(BrowseStore);
    fixture.detectChanges();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('should show validation errors on empty submit', () => {
    component.submit();
    const e = component.errors();
    expect(e.title).toBeTruthy();
    expect(e.language).toBeTruthy();
    expect(e.genres).toBeTruthy();
  });

  it('addLanguage should add to store and reject duplicates', () => {
    const before = store.languages().length;
    component.newLang.set('French');
    component.addLanguage();
    expect(store.languages()).toContain('French');
    expect(store.languages().length).toBe(before + 1);

    // duplicate
    component.newLang.set('french');
    component.addLanguage();
    expect(store.languages().length).toBe(before + 1); // no change

    // cleanup
    store.removeLanguage('French');
  });

  it('addGenre should add to store and reject duplicates', () => {
    const before = store.genres().length;
    component.newGenre.set('Western');
    component.addGenre();
    expect(store.genres()).toContain('Western');
    expect(store.genres().length).toBe(before + 1);

    component.newGenre.set('western');
    component.addGenre();
    expect(store.genres().length).toBe(before + 1);

    store.removeGenre('Western');
  });

  it('should add movie to store on valid submit', () => {
    const before = store.movies().length;
    component.title.set('Test Movie');
    component.language.set(store.languages()[0]);
    component.selectedGenres.set([store.genres()[0]]);
    component.thumbnail.set('https://example.com/img.jpg');
    component.releaseYear.set(2024);
    component.pricePerDay.set(49);
    component.submit();
    expect(store.movies().length).toBe(before + 1);
    const added = store.movies().find(m => m.title === 'Test Movie');
    if (added) store.deleteMovie(added.id);
  });

  it('canSubmit should be false when no languages', () => {
    const langs = [...store.languages()];
    langs.forEach(l => store.removeLanguage(l));
    fixture.detectChanges();
    expect(component.canSubmit()).toBe(false);
    langs.forEach(l => store.addLanguage(l));
  });
});
