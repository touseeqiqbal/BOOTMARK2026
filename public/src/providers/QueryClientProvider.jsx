import { QueryClient, QueryClientProvider as Provider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            cacheTime: 1000 * 60 * 30, // 30 minutes
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
})

export default function QueryClientProvider({ children }) {
    return (
        <Provider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </Provider>
    )
}
