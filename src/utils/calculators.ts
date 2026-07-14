//calculate radius in mm
export const calculateRadius = (sagitta: number, diameter: number, lensType: 'minus' | 'plus') => {
	return lensType === 'minus'
		? -(sagitta / 2 + Math.pow(diameter, 2) / (8 * sagitta))
		: sagitta / 2 + Math.pow(diameter, 2) / (8 * sagitta);
};

//calculate saggita in mm
export const calculateSagitta = (radius: number, diameter: number, lensType: 'minus' | 'plus') => {
	const halfChord = diameter / 2;
	const multiplier = lensType === 'minus' ? -1 : 1;
	return radius - multiplier * (Math.sqrt(Math.pow(radius, 2) - Math.pow(halfChord, 2)));
};
