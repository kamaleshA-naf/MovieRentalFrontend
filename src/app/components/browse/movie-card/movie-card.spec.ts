import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowseCardComponent } from './movie-card';
import { BrowseStore } from '../../../services/browse.store';
import { BrowseToastService } from '../../../services/browse-toast.service';

describe('BrowseCardComponent', () => {
  let fixture: ComponentFixture<BrowseCardComponent>;
  let store: BrowseStore;

  const mockMovie = {
    id:1, title:'Test', description:'', director:'', releaseYear:2024,
    pricePerDay:49, thumbnail:'', videoUrl:'', language:'Tamil',
    genres:['Action'], isTrending:true, isNew:false, topTen:true
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrowseCardComponent],
      providers: [BrowseStore, BrowseToastService]
    }).compileComponents();
    fixture = TestBed.createComponent(BrowseCardComponent);
    store   = TestBed.inject(BrowseStore);
    fixture.componentRef.setInput('movie', mockMovie);
    fixture.detectChanges();
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());

  it('should show Top 10 badge', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.top10')).toBeTruthy();
  });

  it('should use placeholder when thumbnail is empty', () => {
    expect(fixture.componentInstance.imgSrc()).toBe(store.placeholder);
  });

  it('toggleList should add movie to myList', () => {
    expect(store.isInMyList(1)).toBe(false);
    store.toggleMyList(1);
    expect(store.isInMyList(1)).toBe(true);
    store.toggleMyList(1); // cleanup
  });
});
