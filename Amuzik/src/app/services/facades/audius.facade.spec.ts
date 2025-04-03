import { TestBed } from '@angular/core/testing';

import { AudiusFacade } from './audius.facade';

describe('AudiusService', () => {
  let service: AudiusFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudiusFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
