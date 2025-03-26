import { TestBed } from '@angular/core/testing';

import { AudiusService } from './audius.facade';

describe('AudiusService', () => {
  let service: AudiusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudiusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
