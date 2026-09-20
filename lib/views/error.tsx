import type { FC } from 'hono/jsx';

import { gitDate, gitHash } from '@/utils/git-hash';
import { Layout } from '@/views/layout';

const Index: FC<{
    requestPath: string;
    message: string;
    errorRoute: string;
    nodeVersion: string;
}> = ({ requestPath, message, errorRoute, nodeVersion }) => (
    <Layout>
        <div
            className="pointer-events-none absolute w-full min-h-screen dark:invert"
            style={{
                backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAzMiAzMicgd2lkdGg9JzMyJyBoZWlnaHQ9JzMyJyBmaWxsPSdub25lJyBzdHJva2U9J3JnYigxNSAyMyA0MiAvIDAuMDQpJz48cGF0aCBkPSdNMCAuNUgzMS41VjMyJy8+PC9zdmc+')`,
                maskImage: 'linear-gradient(transparent, black, transparent)',
            }}
        ></div>
        <div className="w-full grow shrink-0 py-8 flex items-center justify-center flex-col space-y-4">
            <img className="grayscale" src="/logo.png" alt="RSSHub" width="100" loading="lazy" />
            <h1 className="text-4xl font-bold">Looks like something went wrong</h1>
            <div className="text-left w-[800px] space-y-6 !mt-10">
                <div className="space-y-2">
                    <p className="mb-2 font-bold">Helpful Information</p>
                    <p className="message">
                        Error Message:
                        <br />
                        <code className="mt-2 block max-h-28 overflow-auto bg-zinc-100 dark:bg-zinc-800 align-bottom w-fit details whitespace-pre-line">{message}</code>
                    </p>
                    <p className="message">
                        Route: <code className="ml-2 bg-zinc-100 dark:bg-zinc-800">{errorRoute}</code>
                    </p>
                    <p className="message">
                        Full Route: <code className="ml-2 bg-zinc-100 dark:bg-zinc-800">{requestPath}</code>
                    </p>
                    <p className="message">
                        Node Version: <code className="ml-2 bg-zinc-100 dark:bg-zinc-800">{nodeVersion}</code>
                    </p>
                    <p className="message">
                        Git Hash: <code className="ml-2 bg-zinc-100 dark:bg-zinc-800">{gitHash}</code>
                    </p>
                    <p className="message">
                        Git Date: <code className="ml-2 bg-zinc-100 dark:bg-zinc-800">{gitDate?.toUTCString()}</code>
                    </p>
                </div>
                <div>
                    <p className="mb-2 font-bold">Report</p>
                    <p>
                        If you encounter an issue or bug with Hub Alert, please{' '}
                        <a className="text-[#F5712C]" href="https://github.com/dntrieunguyen/hub-alert/issues/new" target="_blank">
                            submit an issue
                        </a>{' '}
                        on GitHub.
                    </p>
                </div>
            </div>
        </div>
        <div className="mt-4 pb-8 text-center w-full text-sm font-medium space-y-2 text-zinc-500 dark:text-zinc-400">
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

export default Index;
