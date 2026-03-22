import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadMovie } from './upload-movie';

describe('UploadMovie', () => {
  let component: UploadMovie;
  let fixture: ComponentFixture<UploadMovie>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadMovie],
    }).compileComponents();

    fixture = TestBed.createComponent(UploadMovie);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
