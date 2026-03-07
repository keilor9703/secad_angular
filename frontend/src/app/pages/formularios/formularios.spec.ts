import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Formularios } from './formularios';

describe('Formularios', () => {
  let component: Formularios;
  let fixture: ComponentFixture<Formularios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Formularios]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Formularios);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
