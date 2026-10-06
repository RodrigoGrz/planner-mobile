import {
  notifyTripRemoved,
  subscribeTripRemoved,
} from "@/services/trip-sync-events";

describe("trip-sync-events", () => {
  it("should notify removal listeners for each removed trip id", () => {
    const localListener = jest.fn();
    const remoteListener = jest.fn();
    const unsubscribeLocal = subscribeTripRemoved("local-1", localListener);
    const unsubscribeRemote = subscribeTripRemoved("remote-1", remoteListener);

    notifyTripRemoved(["local-1", "remote-1"]);

    expect(localListener).toHaveBeenCalledTimes(1);
    expect(remoteListener).toHaveBeenCalledTimes(1);

    unsubscribeLocal();
    unsubscribeRemote();
  });

  it("should not notify removal listeners of other trips", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeTripRemoved("t2", listener);

    notifyTripRemoved(["t1"]);

    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("should not notify a removal listener after unsubscribing", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeTripRemoved("t1", listener);

    unsubscribe();
    notifyTripRemoved(["t1"]);

    expect(listener).not.toHaveBeenCalled();
  });
});
