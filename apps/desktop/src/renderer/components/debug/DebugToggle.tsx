/**
 * Debug Toggle Component
 * ======================
 *
 * Menu item or button to toggle the agent debug panel.
 */

import { Bug } from 'lucide-react';
import { useDebugStore } from '../../stores/debug-store';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

export function DebugToggle() {
  const { isDebugPanelVisible, toggleDebugPanel } = useDebugStore();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isDebugPanelVisible ? 'default' : 'ghost'}
            size="sm"
            onClick={toggleDebugPanel}
            className={isDebugPanelVisible ? 'animate-pulse' : ''}
          >
            <Bug className="h-4 w-4" />
            {isDebugPanelVisible && <span className="ml-2">Debug</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Toggle Agent Debug Panel</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
