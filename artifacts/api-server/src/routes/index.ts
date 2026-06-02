import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import leadsRouter from "./leads";
import dashboardRouter from "./dashboard";
import dialerRouter from "./dialer";
import partnersRouter from "./partners";
import bulkUploadRouter from "./bulk-upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(leadsRouter);
router.use(dashboardRouter);
router.use(dialerRouter);
router.use(partnersRouter);
router.use(bulkUploadRouter);

export default router;
