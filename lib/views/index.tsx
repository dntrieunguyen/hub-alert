import type { FC } from 'hono/jsx';

import { config } from '@/config';
import { getDebugInfo } from '@/utils/debug-info';
import { gitDate, gitHash } from '@/utils/git-hash';
import { Layout } from '@/views/layout';

const startTime = Date.now();

const Index: FC<{ debugQuery: string | undefined }> = ({ debugQuery }) => {
    const debug = getDebugInfo();

    const showDebug = !config.debugInfo || config.debugInfo === 'false' ? false : config.debugInfo === 'true' || config.debugInfo === debugQuery;
    const { disallowRobot, nodeName, cache } = config;

    const duration = Date.now() - startTime;

    const info = {
        showDebug,
        disallowRobot,
        debug: [
            ...(nodeName
                ? [
                      {
                          name: 'Node Name',
                          value: nodeName,
                      },
                  ]
                : []),
            ...(gitHash
                ? [
                      {
                          name: 'Git Hash',
                          value: (
                              <a className="underline" href={`https://github.com/dntrieunguyen/hub-alert/commit/${gitHash}`}>
                                  {gitHash}
                              </a>
                          ),
                      },
                  ]
                : []),
            ...(gitDate
                ? [
                      {
                          name: 'Git Date',
                          value: gitDate.toUTCString(),
                      },
                  ]
                : []),
            {
                name: 'Cache Duration',
                value: cache.routeExpire + 's',
            },
            {
                name: 'Request Amount',
                value: debug.request,
            },
            {
                name: 'Request Frequency',
                value: ((debug.request / (duration / 1000)) * 60).toFixed(3) + ' times/minute',
            },
            {
                name: 'Cache Hit Ratio',
                value: debug.request ? ((debug.hitCache / debug.request) * 100).toFixed(2) + '%' : 0,
            },
            {
                name: 'ETag Matched Ratio',
                value: debug.request ? ((debug.etag / debug.request) * 100).toFixed(2) + '%' : 0,
            },
            {
                name: 'Health',
                value: debug.request ? ((1 - debug.error / debug.request) * 100).toFixed(2) + '%' : 0,
            },
            {
                name: 'Uptime',
                value: (duration / 3_600_000).toFixed(2) + ' hour(s)',
            },
            {
                name: 'Hot Routes',
                value: Object.keys(debug.routes)
                    .toSorted((a, b) => debug.routes[b] - debug.routes[a])
                    .slice(0, 30)
                    .map((route) => (
                        <>
                            {debug.routes[route]} {route}
                            <br />
                        </>
                    )),
            },
            {
                name: 'Hot Paths',
                value: Object.keys(debug.paths)
                    .toSorted((a, b) => debug.paths[b] - debug.paths[a])
                    .slice(0, 30)
                    .map((path) => (
                        <>
                            {debug.paths[path]} {path}
                            <br />
                        </>
                    )),
            },
            {
                name: 'Hot Error Routes',
                value: Object.keys(debug.errorRoutes)
                    .toSorted((a, b) => debug.errorRoutes[b] - debug.errorRoutes[a])
                    .slice(0, 30)
                    .map((route) => (
                        <>
                            {debug.errorRoutes[route]} {route}
                            <br />
                        </>
                    )),
            },
            {
                name: 'Hot Error Paths',
                value: Object.keys(debug.errorPaths)
                    .toSorted((a, b) => debug.errorPaths[b] - debug.errorPaths[a])
                    .slice(0, 30)
                    .map((path) => (
                        <>
                            {debug.errorPaths[path]} {path}
                            <br />
                        </>
                    )),
            },
        ],
    };

    return (
        <Layout>
            <div
                className="pointer-events-none absolute w-full min-h-screen dark:invert"
                style={{
                    backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAzMiAzMicgd2lkdGg9JzMyJyBoZWlnaHQ9JzMyJyBmaWxsPSdub25lJyBzdHJva2U9J3JnYigxNSAyMyA0MiAvIDAuMDQpJz48cGF0aCBkPSdNMCAuNUgzMS41VjMyJy8+PC9zdmc+')`,
                    maskImage: 'linear-gradient(transparent, black, transparent)',
                }}
            ></div>
            <div className="w-full grow shrink-0 py-8 flex items-center justify-center flex-col space-y-4">
                <img src="./logo.png" alt="Hub Alert" width="100" loading="lazy" />
                <h1 className="text-4xl font-bold">
                    Welcome to <span className="text-[#F5712C]">Hub Alert</span>!
                </h1>
                <p className="text-xl font-medium text-zinc-600 dark:text-zinc-300">Personal RSS & Intelligence Alert Collector.</p>
                <p className="text-zinc-500 dark:text-zinc-400">Hub Alert is up and running successfully.</p>
                <div className="font-bold space-x-4 text-sm !mt-6">
                    <a target="_blank" href="https://github.com/dntrieunguyen/hub-alert">
                        <button className="text-white bg-[#F5712C] hover:bg-[#DD4A15] py-2 px-4 rounded-full transition-colors">GitHub Repository</button>
                    </a>
                    <a href="/api/collector/status">
                        <button className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 py-2 px-4 rounded-full transition-colors">Collector Status</button>
                    </a>
                </div>
                {info.showDebug ? (
                    <details className="text-xs w-96 !mt-8 max-h-[400px] overflow-auto">
                        <summary className="text-sm cursor-pointer">Debug Info</summary>
                        {info.debug.map((item) => (
                            <div class="debug-item my-3 pl-8">
                                <span class="debug-key w-32 text-right inline-block mr-2">{item.name}: </span>
                                <span class="debug-value inline-block break-all align-top">{item.value}</span>
                            </div>
                        ))}
                    </details>
                ) : null}
            </div>

            <div className="text-center pt-6 pb-8 w-full text-sm font-medium space-y-2 text-zinc-500 dark:text-zinc-400">
                <p className="space-x-4">
                    <a target="_blank" href="https://github.com/dntrieunguyen/hub-alert">
                        <picture>
                            <source srcset="https://icons.ly/github/_/fff" media="(prefers-color-scheme: dark)" />
                            <img className="inline" src="https://icons.ly/github" alt="github" width="20" height="20" />
                        </picture>
                    </a>
                </p>
                <p>
                    Hub Alert © dntrieunguyen · Built upon open source RSSHub engine under AGPL-3.0 License.
                </p>
            </div>
        </Layout>
    );
};

export default Index;
