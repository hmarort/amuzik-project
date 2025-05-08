import { TestBed } from '@angular/core/testing';

import { BiometricService } from './biometric.service';

describe('BiometricService', () => {
  let service: BiometricService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BiometricService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
