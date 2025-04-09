import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AparienciaPage } from './apariencia.page';

describe('AparienciaPage', () => {
  let component: AparienciaPage;
  let fixture: ComponentFixture<AparienciaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AparienciaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
