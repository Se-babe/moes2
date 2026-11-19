import React, { Suspense } from 'react';
import { Loading } from '../components/ui';

/**
 * Wraps a screen so its code is downloaded only when it is first shown.
 * `Screen.preload()` starts the download early without rendering it.
 */
export function lazyScreen(loader) {
  let promise = null;
  const load = () => {
    if (!promise) {
      promise = Promise.resolve().then(loader).catch((e) => {
        promise = null; // let a later visit retry after a network error
        throw e;
      });
    }
    return promise;
  };
  const Lazy = React.lazy(load);
  function Screen(props) {
    return (
      <Suspense fallback={<Loading />}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  Screen.preload = load;
  return Screen;
}

/** Download screens in the background once the browser is idle. */
export function preloadScreens(screens) {
  const run = () => screens.forEach((s, i) => setTimeout(() => s.preload().catch(() => {}), i * 150));
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}
