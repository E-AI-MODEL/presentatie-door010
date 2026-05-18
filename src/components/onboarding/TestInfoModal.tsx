import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TEST_INFO_BLOCKS, InfoBlock } from "./TestOnboardingPopup";

interface TestInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestInfoModal({ open, onOpenChange }: TestInfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 gap-0 overflow-hidden">
        <ScrollArea className="max-h-[80vh]">
          <div className="p-6 space-y-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-foreground">
                Testinfo DoorAI A/B-test (variant B)
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Dit is een testomgeving voor de werkgroep. Geen productieversie.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <InfoBlock {...TEST_INFO_BLOCKS.intro} />
              <InfoBlock {...TEST_INFO_BLOCKS.whatToTest} />
              <InfoBlock {...TEST_INFO_BLOCKS.abTest} />
              <InfoBlock {...TEST_INFO_BLOCKS.testPoints} />
              <InfoBlock {...TEST_INFO_BLOCKS.reminders} />
              <InfoBlock {...TEST_INFO_BLOCKS.otherVariant} />
              <InfoBlock {...TEST_INFO_BLOCKS.session} />
              <InfoBlock {...TEST_INFO_BLOCKS.placeholders} />
            </div>

            <p className="text-xs text-muted-foreground italic">
              Wil je opnieuw de pop-up zien? Refresh de pagina of log uit en open Testinfo.
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
