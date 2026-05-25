// First-run welcome popup. Shown once per browser (localStorage flag) to point
// new users at the guide / interactive tour.

import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Compass, BookOpen, Sun, Play, BarChart3, Save } from 'lucide-react';

interface WelcomeDialogProps {
  open: boolean;
  onClose: () => void;
  onStartTour: () => void;
  onOpenGuide: () => void;
}

export default function WelcomeDialog({ open, onClose, onStartTour, onOpenGuide }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg" data-testid="welcome-dialog">
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-orange-500/15 grid place-items-center">
            <Sun className="h-6 w-6 text-orange-400" />
          </div>
          <DialogTitle className="text-center text-xl">Welcome to eSpark Solar Calculator</DialogTitle>
          <DialogDescription className="text-center">
            New here? Here’s the whole workflow in four quick steps.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 my-2">
          <li className="flex items-center gap-3 text-sm">
            <Sun className="h-4 w-4 text-orange-400 flex-none" />
            <span><strong>1.</strong> Enter the customer’s type, grid connection and monthly consumption under <strong>Inputs</strong>.</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <Play className="h-4 w-4 text-orange-400 flex-none" />
            <span><strong>2.</strong> Click <strong>Calculate System</strong>.</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <BarChart3 className="h-4 w-4 text-orange-400 flex-none" />
            <span><strong>3.</strong> Review savings, yield and sizing under <strong>Results</strong>.</span>
          </li>
          <li className="flex items-center gap-3 text-sm">
            <Save className="h-4 w-4 text-orange-400 flex-none" />
            <span><strong>4.</strong> <strong>Save</strong> the case to your account and reopen it any time.</span>
          </li>
        </ul>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose} className="sm:mr-auto" data-testid="button-welcome-dismiss">
            Skip for now
          </Button>
          <Button variant="outline" onClick={onOpenGuide} className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Read the guide
          </Button>
          <Button onClick={onStartTour} className="flex items-center gap-2" data-testid="button-welcome-tour">
            <Compass className="h-4 w-4" /> Take the tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
