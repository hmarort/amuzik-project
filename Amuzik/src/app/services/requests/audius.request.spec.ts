import { TestBed } from '@angular/core/testing';

import { AudiusRequest } from './audius.request';

describe('AudiusService', () => {
  let service: AudiusRequest;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudiusRequest);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
