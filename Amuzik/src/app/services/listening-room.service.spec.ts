import { TestBed } from '@angular/core/testing';

import { ListeningRoomService } from './listening-room.service';

describe('ListeningRoomService', () => {
  let service: ListeningRoomService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ListeningRoomService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
