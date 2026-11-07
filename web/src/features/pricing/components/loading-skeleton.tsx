/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Skeleton } from '@/components/ui/skeleton'

import { VIEW_MODES, type ViewMode } from '../constants'

export interface LoadingSkeletonProps {
  viewMode?: ViewMode
}

export function LoadingSkeleton(props: LoadingSkeletonProps) {
  return (
    <div aria-busy='true'>
      <div className='mx-auto mb-5 flex max-w-3xl flex-col items-center pt-5 sm:mb-10 sm:pt-10'>
        <Skeleton className='h-[clamp(2.3rem,6.325vw,4.025rem)] w-48 max-w-full sm:w-64' />
        <Skeleton className='mt-3 h-5 w-56 max-w-full sm:mt-4 sm:h-6' />
        <Skeleton className='mt-2 h-5 w-full max-w-xl' />
        <Skeleton className='mt-4 h-10 w-full max-w-2xl sm:mt-6' />
        <div className='mt-4 flex w-full max-w-4xl flex-col gap-3 sm:mt-5'>
          <div className='flex flex-wrap gap-1.5'>
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className='h-8 w-20 rounded-full' />
            ))}
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className='h-8 w-16 rounded-full' />
            ))}
          </div>
        </div>
      </div>
      <div className='flex min-w-0 flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3'>
          <Skeleton className='h-7 w-20' />
          <div className='flex flex-wrap gap-2'>
            <Skeleton className='h-7 w-32' />
            <Skeleton className='h-7 w-20' />
            <Skeleton className='h-7 w-24' />
          </div>
        </div>
        {props.viewMode === VIEW_MODES.TABLE ? (
          <div className='overflow-hidden rounded-xl border'>
            {Array.from({ length: 10 }, (_, index) => (
              <div
                key={index}
                className='flex gap-4 border-b p-4 last:border-0'
              >
                <Skeleton className='h-5 w-40 max-w-full' />
                <Skeleton className='h-5 flex-1' />
                <Skeleton className='h-5 w-20' />
              </div>
            ))}
          </div>
        ) : (
          <div className='flex flex-col gap-4'>
            {Array.from({ length: 2 }, (_, section) => (
              <div
                key={section}
                className='overflow-hidden rounded-xl ring-1 ring-foreground/10'
              >
                <div className='flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5'>
                  <div className='flex items-start gap-3'>
                    <Skeleton className='size-12 shrink-0 rounded-lg' />
                    <div className='flex flex-col gap-2'>
                      <Skeleton className='h-5 w-28' />
                      <Skeleton className='h-4 w-48 max-w-full' />
                    </div>
                  </div>
                  <Skeleton className='h-8 w-36' />
                </div>
                <div className='grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-5 lg:grid-cols-3 xl:grid-cols-3'>
                  {Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={index}
                      className='bg-muted/40 flex flex-col gap-3 rounded-lg border p-4'
                    >
                      <Skeleton className='h-5 w-40 max-w-full' />
                      <Skeleton className='h-4 w-full' />
                      <Skeleton className='h-4 w-3/4' />
                      <div className='mt-auto flex flex-col gap-2 pt-2'>
                        <Skeleton className='h-4 w-full' />
                        <Skeleton className='h-4 w-full' />
                        <Skeleton className='h-7 w-28 self-end' />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
