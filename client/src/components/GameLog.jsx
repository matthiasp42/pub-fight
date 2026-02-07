import { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';

/**
 * @param {{
 *   logs: import('../game/types.js').GameLogEntry[],
 *   open: boolean,
 *   onToggle: () => void
 * }} props
 */
export function GameLog({ logs, open, onToggle }) {
  const [expandedLog, setExpandedLog] = useState(null);

  const formatTimestamp = (ts) => {
    const date = new Date(ts);
    return date.toLocaleTimeString();
  };

  const getLogColor = (log) => {
    if (log.type === 'fight_start') return 'info';
    if (log.type === 'fight_end') return 'success';
    if (log.actorType === 'boss' || log.actorType === 'minion') return 'secondary';
    return 'primary';
  };

  const getLogLabel = (log) => {
    if (log.type !== 'action') return log.type;
    if (log.actorType === 'boss') return 'boss';
    if (log.actorType === 'minion') return 'minion';
    return 'action';
  };

  return (
    <>
      {/* Log Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={onToggle}
        sx={{
          '& .MuiDrawer-paper': {
            width: 400,
            backgroundColor: '#1a1a1a',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#fff' }}>
              Game Log
            </Typography>
            <IconButton onClick={onToggle} sx={{ color: '#fff' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            {logs.length} entries (newest first)
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...logs].reverse().map((log, index) => (
              <Accordion
                key={index}
                expanded={expandedLog === index}
                onChange={() => setExpandedLog(expandedLog === index ? null : index)}
                sx={{
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  '&:before': { display: 'none' },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Chip
                      label={getLogLabel(log)}
                      size="small"
                      color={getLogColor(log)}
                      sx={{ minWidth: 80 }}
                    />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {log.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatTimestamp(log.timestamp)}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    {log.actionResult && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold' }}>
                          Action Result:
                        </Typography>
                        <Box
                          component="pre"
                          sx={{
                            backgroundColor: '#1a1a1a',
                            p: 1,
                            borderRadius: 1,
                            overflow: 'auto',
                            fontSize: '0.7rem',
                            maxHeight: 150,
                          }}
                        >
                          {JSON.stringify(log.actionResult, null, 2)}
                        </Box>
                      </Box>
                    )}

                    {log.actionResult?.targetResults?.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                          Targets:
                        </Typography>
                        <Box
                          component="pre"
                          sx={{
                            backgroundColor: '#1a1a1a',
                            p: 1,
                            borderRadius: 1,
                            overflow: 'auto',
                            fontSize: '0.7rem',
                            maxHeight: 200,
                          }}
                        >
                          {JSON.stringify(
                            log.actionResult.targetResults.map(tr => ({
                              target: tr.targetName,
                              damage: tr.damage,
                              healing: tr.healing,
                              hit: tr.hit,
                            })),
                            null,
                            2
                          )}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
