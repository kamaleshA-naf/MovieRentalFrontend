import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageMovies } from './manage-movies';

describe('ManageMovies', () => {
  let component: ManageMovies;
  let fixture: ComponentFixture<ManageMovies>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageMovies],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageMovies);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
