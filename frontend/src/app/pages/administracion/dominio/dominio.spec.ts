import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dominio } from './dominio';

describe('Dominio', () => {
  let component: Dominio;
  let fixture: ComponentFixture<Dominio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dominio]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dominio);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
