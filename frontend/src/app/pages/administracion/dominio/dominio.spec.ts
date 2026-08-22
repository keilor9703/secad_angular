import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DominioAdminComponent } from './dominio';

describe('DominioAdminComponent', () => {
  let component: DominioAdminComponent;
  let fixture: ComponentFixture<DominioAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DominioAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DominioAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
