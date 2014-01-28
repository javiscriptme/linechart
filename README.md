linechart
=========

	private function lineChartData () {
		$serie1 = array(
			array('x' => 1390860000000, 'y' => 750),
			array('x' => 1390860600000, 'y' => 755),
			array('x' => 1390861200000, 'y' => 758),
			array('x' => 1390861800000, 'y' => 757),
		);
		$serie2 = array(
			array('x' => 1390860000000, 'y' => 720),
			array('x' => 1390860600000, 'y' => 718),
			array('x' => 1390861200000, 'y' => 722),
			array('x' => 1390861800000, 'y' => 728),
		);

		return array(
			'type' => 'line',
			'series' => array(
				array(
					'key'   => 'buy',
					'color' => '#0000FF',
					'values' => $serie1,
				),
				array(
					'key'   => 'sell',
					'color' => '#00FF00',
					'values' => $serie2,
				),
			),
			'options' => array(
				'dual_axis' => FALSE
			)
		);
	}
