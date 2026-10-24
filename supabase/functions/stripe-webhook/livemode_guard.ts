export type StripeModeEvent = {
  id: string;
  type: string;
  livemode: boolean;
};

/** Run event business logic only for live-mode events on this live endpoint. */
export async function runForLiveStripeEvent<T>(
  event: StripeModeEvent,
  handleLiveEvent: () => Promise<T>,
  handleTestEvent: (event: StripeModeEvent) => void,
): Promise<T | undefined> {
  if (!event.livemode) {
    handleTestEvent(event);
    return undefined;
  }

  return handleLiveEvent();
}
