import * as electron from 'electron';
import { BrowserWindow } from 'electron';
import Analytics from 'analytics-node';
import { app } from 'electron';

import isDev from '@main/utils/isDev';
import MainSyncService, { StorageKey } from '@main/services/mainSync.service';
import MainIPCService, { IPCSendChannel } from '@main/services/mainIPC.service';

import { User } from '@renderer/user/user';
import { AnalyticsEvent, AnalyticsPayload } from '@renderer/services/analytics.service/analyticsEvent';

class MainAnalyticsService {
  private constructor() { }
  private static readonly writeKey = isDev ? 'g0PqvygVRpBCVkPF78LCP9gidnwPKo7s' : 'BBXIANCzegnEoaL8k1YWN6HPqb3z0yaf';
  private static readonly flushAt = isDev ? 1 : 5;
  private static readonly analytics = new Analytics(MainAnalyticsService.writeKey, { flushAt: MainAnalyticsService.flushAt });
  private static readonly appVersion = app.getVersion();
  private static readonly platform = process.platform;

  private static isSignedIn = false;
  private static userID: string | undefined = undefined;
  private static anonymousID = MainAnalyticsService.initializeAnonymousID();

  private static initializeAnonymousID() {
    const anonymousID = MainSyncService.get(StorageKey.UserID);
    MainSyncService.set(StorageKey.UserID, anonymousID);
    return anonymousID;
  }

  static track<T extends AnalyticsEvent>(event: T, payload: AnalyticsPayload[T], options?: { userID?: string, searchWindow?: electron.BrowserWindow }) {
    return MainAnalyticsService.analytics.track({
      event,
      anonymousId: MainAnalyticsService.anonymousID,
      userId: options?.userID,
      // TODO: What about search window width and height?
      properties: {
        ...payload,
        isSignedIn: MainAnalyticsService.isSignedIn,
        appVersion: MainAnalyticsService.appVersion,
        platform: MainAnalyticsService.platform,
        ...options?.searchWindow && {
          searchWindowWidth: options?.searchWindow?.getSize()[0],
          searchWindowHeight: options?.searchWindow?.getSize()[1],
        },
      }
    });
  }

  static trackAndFlush<T extends AnalyticsEvent>(event: T, payload: AnalyticsPayload[T], options?: { userID?: string, anonymousID: string, searchWindow?: electron.BrowserWindow }) {
    return new Promise<void>((resolve, reject) => {
      MainAnalyticsService.track(event, payload, options)
        .flush((error) => {
          if (error !== null) {
            return reject(error);
          } else {
            return resolve();
          }
        });
    });
  }

  static identify(traits: Record<string, any>, options?: { searchWindow?: BrowserWindow }) {
    return MainAnalyticsService.analytics.identify({
      anonymousId: MainAnalyticsService.anonymousID,
      ...MainAnalyticsService.userID && { userId: MainAnalyticsService.userID },
      traits: {
        ...traits,
        ...MainAnalyticsService.userID && { isSignedUp: true },
        platform: MainAnalyticsService.platform,
        anonymousID: MainAnalyticsService.anonymousID,
        appVersion: MainAnalyticsService.appVersion,
        ...options?.searchWindow && {
          searchWindowWidth: options?.searchWindow?.getSize()[0],
          searchWindowHeight: options?.searchWindow?.getSize()[1],
        },
      },
    });
  }

  static changeUser(user: User | undefined, options?: { searchWindow?: BrowserWindow }) {
    if (!user) {
      MainAnalyticsService.isSignedIn = false;
      MainAnalyticsService.userID = undefined;
      return;
    }
    MainAnalyticsService.isSignedIn = true;
    MainAnalyticsService.userID = user.userID;
    return MainAnalyticsService.analytics.identify({
      anonymousId: MainAnalyticsService.anonymousID,
      userId: MainAnalyticsService.userID,
      traits: {
        isSignedUp: true,
        platform: MainAnalyticsService.platform,
        appVersion: MainAnalyticsService.appVersion,
        email: user.email,
        ...options?.searchWindow && {
          searchWindowWidth: options?.searchWindow?.getSize()[0],
          searchWindowHeight: options?.searchWindow?.getSize()[1],
        },
      },
    });
  }
}

MainIPCService.on(IPCSendChannel.AnalyticsTrack, (_, payload) => {
  MainAnalyticsService.track(payload.event, payload.payload);
});

export { AnalyticsEvent };
export default MainAnalyticsService;