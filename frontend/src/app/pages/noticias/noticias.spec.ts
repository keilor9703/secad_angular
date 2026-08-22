import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoticiasWeb } from './noticias';

describe('NoticiasWeb', () => {
  let component: NoticiasWeb;
  let fixture: ComponentFixture<NoticiasWeb>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoticiasWeb]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NoticiasWeb);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
